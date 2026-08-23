import { PaymentStatus, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import Stripe from 'stripe';

const apply = process.argv.includes('--apply');
const verbose = process.argv.includes('--verbose');
const envFileArg = process.argv.find((arg) => arg.startsWith('--env-file='));
const envFile = envFileArg
  ? envFileArg.slice('--env-file='.length).trim()
  : '.env';
if (!fs.existsSync(envFile)) {
  throw new Error(`Env file not found: ${envFile}`);
}
dotenv.config({ path: envFile, override: true });
const requestedConcurrency = Number(
  process.env.RECONCILIATION_CONCURRENCY || 10,
);
const concurrency = Math.min(
  25,
  Math.max(1, Number.isFinite(requestedConcurrency) ? requestedConcurrency : 10),
);
if (apply && process.env.CONFIRM_RECONCILIATION !== 'apply') {
  throw new Error(
    'Refusing to write. Set CONFIRM_RECONCILIATION=apply and pass --apply after reviewing the dry-run output.',
  );
}

const databaseUrl = process.env.DATABASE_URL;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!databaseUrl || !stripeSecretKey) {
  throw new Error('DATABASE_URL and STRIPE_SECRET_KEY must be configured.');
}
if (!stripeSecretKey.startsWith('sk_live_')) {
  console.error(
    `WARNING: running with a non-live Stripe key (${stripeSecretKey.slice(0, 10)}…). Live sessions will not resolve, so every order will be skipped. Pass --env-file=.env.production for production data.`,
  );
}

const prisma = new PrismaClient();
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

type ReconciliationRow = {
  orderId: string;
  sessionId: string;
  status: 'verified' | 'skipped';
  reason: string;
  databaseAmount: number;
  stripeAmount?: number;
  changed: boolean;
};

type ReconciliationOrder = {
  id: string;
  sessionId: string;
  paymentId: string | null;
  amountPaid: number | null;
  paidAt: Date | null;
};

function csvValue(value: string | number | boolean | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function getPaymentDetails(sessionId: string, orderId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });
  const paymentIntent = session.payment_intent;

  if (
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    session.metadata?.orderId !== orderId ||
    !paymentIntent ||
    session.amount_total === null
  ) {
    return null;
  }

  const paymentId =
    typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id;
  const latestCharge =
    typeof paymentIntent === 'string' ? null : paymentIntent.latest_charge;
  const paidAt =
    typeof latestCharge === 'object' && latestCharge?.created
      ? new Date(latestCharge.created * 1000)
      : new Date();

  return {
    amountPaid: session.amount_total / 100,
    paymentId,
    paidAt,
  };
}

async function reconcileOrder(
  order: ReconciliationOrder,
): Promise<ReconciliationRow> {
  try {
    const payment = await getPaymentDetails(order.sessionId, order.id);
    if (!payment) {
      if (verbose) {
        console.error(
          `Skipped order ${order.id}: its Stripe Checkout Session did not verify against this platform order.`,
        );
      }
      return {
        orderId: order.id,
        sessionId: order.sessionId,
        status: 'skipped',
        reason: 'Stripe Session does not match this paid platform order',
        databaseAmount: order.amountPaid || 0,
        changed: false,
      };
    }

    const correctionReasons: string[] = [];
    if (order.amountPaid !== payment.amountPaid) {
      correctionReasons.push('amount_mismatch');
    }
    if (!order.paymentId) {
      correctionReasons.push('missing_payment_id');
    } else if (order.paymentId !== payment.paymentId) {
      correctionReasons.push('payment_id_mismatch');
    }
    if (!order.paidAt) {
      correctionReasons.push('missing_paid_at');
    }
    const changed = correctionReasons.length > 0;
    if (apply && changed) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          amountPaid: payment.amountPaid,
          paymentId: payment.paymentId,
          paidAt: payment.paidAt,
        },
      });
    }

    return {
      orderId: order.id,
      sessionId: order.sessionId,
      status: 'verified',
      reason: changed ? correctionReasons.join('|') : 'already correct',
      databaseAmount: order.amountPaid || 0,
      stripeAmount: payment.amountPaid,
      changed,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Stripe lookup failed';
    if (verbose) {
      console.error(`Skipped order ${order.id}: ${reason}.`);
    }
    return {
      orderId: order.id,
      sessionId: order.sessionId,
      status: 'skipped',
      reason,
      databaseAmount: order.amountPaid || 0,
      changed: false,
    };
  }
}

async function reconcile() {
  console.error(
    'Connecting to MongoDB and loading successful platform orders.',
  );
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: PaymentStatus.SUCCESSFUL,
      sessionId: { not: null },
    },
    select: {
      id: true,
      sessionId: true,
      paymentId: true,
      amountPaid: true,
      paidAt: true,
    },
  });
  const report: ReconciliationRow[] = new Array(orders.length);
  let verifiedCount = 0;
  let skippedCount = 0;
  let correctionCount = 0;

  console.error(
    `Starting ${apply ? 'apply' : 'dry-run'} reconciliation for ${orders.length} paid orders with Checkout Session IDs.`,
  );
  console.error(
    `Using ${concurrency} concurrent Stripe lookups (set RECONCILIATION_CONCURRENCY to adjust, maximum 25).`,
  );
  console.error(
    'Each order is checked against its saved Stripe Checkout Session. Only a paid session whose metadata references the same order is eligible for correction.',
  );

  let nextOrderIndex = 0;
  let processedCount = 0;
  const workers = Array.from({ length: Math.min(concurrency, orders.length) }, () =>
    (async () => {
      while (nextOrderIndex < orders.length) {
        const index = nextOrderIndex++;
        const row = await reconcileOrder(orders[index]);
        report[index] = row;
        processedCount += 1;
        if (row.status === 'verified') verifiedCount += 1;
        else skippedCount += 1;
        if (row.changed) correctionCount += 1;

        if (processedCount % 25 === 0 || processedCount === orders.length) {
          console.error(
            `Processed ${processedCount}/${orders.length}: ${verifiedCount} verified, ${skippedCount} skipped, ${correctionCount} ${apply ? 'corrected or pending correction' : 'would be corrected'}.`,
          );
        }
      }
    })(),
  );
  await Promise.all(workers);

  console.log(
    [
      'orderId',
      'sessionId',
      'status',
      'reason',
      'databaseAmount',
      'stripeAmount',
      'changed',
    ].join(','),
  );
  for (const row of report) {
    console.log(
      [
        row.orderId,
        row.sessionId,
        row.status,
        row.reason,
        row.databaseAmount,
        row.stripeAmount,
        row.changed,
      ]
        .map(csvValue)
        .join(','),
    );
  }

  console.error(
    `Reconciliation ${apply ? 'apply' : 'dry run'} complete: ${verifiedCount} verified, ${correctionCount} ${apply ? 'corrected' : 'would be corrected'}, ${skippedCount} skipped. Review the CSV before running with --apply.`,
  );
}

reconcile()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
