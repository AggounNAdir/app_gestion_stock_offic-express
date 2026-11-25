import { LicenseInfo } from '../types';

export function verifyLicense(license: LicenseInfo): LicenseInfo {
  const expDate = new Date(license.date_expiration);
  const now = new Date();
  const diffTime = expDate.getTime() - now.getTime();
  const jours_restants = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const est_valide = jours_restants > 0 && license.cle.startsWith('GSKEY');

  return {
    ...license,
    est_valide,
    jours_restants: Math.max(0, jours_restants)
  };
}
