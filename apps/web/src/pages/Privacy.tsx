import { usePageTitle } from '../hooks/usePageTitle';

export function Privacy() {
  usePageTitle('Privacy');
  return (
    <article>
      <h1>Privacy</h1>
      <p className="note">
        Draft. This page describes how GlowLogic is being designed. The full privacy policy
        and terms are written before launch and are not legal advice.
      </p>
      <h2>Design commitments</h2>
      <ul>
        <li>Photo analysis is designed to run in your browser. Photos are not uploaded by default.</li>
        <li>If you choose to save a photo, you will give separate consent and can delete it at any time.</li>
        <li>Photos are never used to train models.</li>
        <li>You can export your data and delete your account, which removes your data.</li>
        <li>Analytics are anonymous and contain no account or session identifiers.</li>
        <li>GlowLogic is for adults (18+).</li>
      </ul>
    </article>
  );
}
