import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsAOrB(
  options: { fieldA: string; fieldB: string },
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsAOrB',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedProps] = args.constraints;
          const fieldA = (args.object as any)[relatedProps.fieldA];
          const fieldB = (args.object as any)[relatedProps.fieldB];

          if (
            fieldA &&
            (fieldB === undefined || fieldB === null || fieldB === 0)
          ) {
            return true;
          }

          if (
            fieldB &&
            (fieldA === undefined || fieldA === null || fieldA === 0)
          ) {
            return true;
          }

          return false; // Both fields are either set or both are unset, so it's invalid
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedProps] = args.constraints;
          return `${relatedProps.fieldA} and ${relatedProps.fieldB} cannot both be set simultaneously, or both be missing. One of them must be present and the other should be absent, undefined, or zero.`;
        },
      },
    });
  };
}

export function IsStartDateBeforeEndDate(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStartDateBeforeEndDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        // value is end date
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          // related value is start date
          const relatedValue = (args.object as any)[relatedPropertyName];
          if (value && relatedValue) {
            return value > relatedValue; // Ensure endDate < startDate
          }
          return true; // If no value provided for either date, pass validation
        },
      },
    });
  };
}
