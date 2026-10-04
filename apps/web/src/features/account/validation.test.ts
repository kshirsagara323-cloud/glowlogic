import { describe, expect, it } from 'vitest';
import { validateLogin, validateRegister } from './validation';

const valid = {
  email: 'person@example.com',
  password: 'a long passphrase',
  confirmPassword: 'a long passphrase',
  confirmedAdult: true,
  acceptedPolicies: true,
};

describe('validateRegister', () => {
  it('accepts valid input', () => {
    expect(validateRegister(valid)).toEqual({});
  });
  it('rejects a bad email', () => {
    expect(validateRegister({ ...valid, email: 'not-an-email' }).email).toBeDefined();
  });
  it('rejects a short password', () => {
    expect(validateRegister({ ...valid, password: 'short', confirmPassword: 'short' }).password).toBeDefined();
  });
  it('rejects mismatched passwords', () => {
    expect(validateRegister({ ...valid, confirmPassword: 'different one' }).confirmPassword).toBeDefined();
  });
  it('requires adult confirmation and policy acceptance', () => {
    const errors = validateRegister({ ...valid, confirmedAdult: false, acceptedPolicies: false });
    expect(errors.confirmedAdult).toBeDefined();
    expect(errors.acceptedPolicies).toBeDefined();
  });
});

describe('validateLogin', () => {
  it('requires both fields', () => {
    const errors = validateLogin('', '');
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });
  it('passes with email and password', () => {
    expect(validateLogin('a@b.co', 'x')).toEqual({});
  });
});
