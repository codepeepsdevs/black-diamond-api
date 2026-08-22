import { PaymentStatus, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const apply = process.argv.includes('--apply');
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

async function reconcile() {
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
  const report: ReconciliationRow[] = [];

  for (const order of orders) {
    try {
      const payment = await getPaymentDetails(order.sessionId, order.id);
      if (!payment) {
        report.push({
          orderId: order.id,
          sessionId: order.sessionId,
          status: 'skipped',
          reason: 'Stripe Session does not match this paid platform order',
          databaseAmount: order.amountPaid || 0,
          changed: false,
        });
        continue;
      }

      const changed =
        order.amountPaid !== payment.amountPaid ||
        order.paymentId !== payment.paymentId ||
        !order.paidAt;
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

      report.push({
        orderId: order.id,
        sessionId: order.sessionId,
        status: 'verified',
        reason: changed ? (apply ? 'corrected' : 'would correct') : 'already correct',
        databaseAmount: order.amountPaid || 0,
        stripeAmount: payment.amountPaid,
        changed,
      });
    } catch (error) {
      report.push({
        orderId: order.id,
        sessionId: order.sessionId,
        status: 'skipped',
        reason: error instanceof Error ? error.message : 'Stripe lookup failed',
        databaseAmount: order.amountPaid || 0,
        changed: false,
      });
    }
  }

  console.log(
    ['orderId', 'sessionId', 'status', 'reason', 'databaseAmount', 'stripeAmount', 'changed']
      .join(','),
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

  const verified = report.filter((row) => row.status === 'verified').length;
  const changed = report.filter((row) => row.changed).length;
  console.error(
    `Reconciliation ${apply ? 'applied' : 'dry run'} complete: ${verified} verified, ${changed} ${apply ? 'corrected' : 'would be corrected'}, ${report.length - verified} skipped.`,
  );
}

reconcile()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
