import { ButtonLink } from '../components/Button';
import { usePageTitle } from '../hooks/usePageTitle';

export function NotFound() {
  usePageTitle('Page not found');
  return (
    <section>
      <h1>Page not found</h1>
      <p>We couldn&rsquo;t find that page. It may have moved or never existed.</p>
      <ButtonLink to="/">Back to home</ButtonLink>
    </section>
  );
}
