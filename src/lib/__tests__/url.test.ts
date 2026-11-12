/// <reference types="jest" />
import { acceptableUrl } from '../url';

it('production : HTTPS obligatoire', () => {
  expect(acceptableUrl('http://192.168.1.10:54321', false)).toBe(false);
  expect(acceptableUrl('https://projet.supabase.co', false)).toBe(true);
  expect(acceptableUrl('http://10.0.2.2:54321', true)).toBe(true);
  expect(acceptableUrl(undefined, true)).toBe(false);
});
