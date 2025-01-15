import { AuthButtons } from '~/components/header/AuthButtons';
import styles from '~/components/auth/AuthPage.module.scss';

export default function AuthPage() {
  return (
    <div className={styles.authPage}>
      <h1>Sign In</h1>
      <AuthButtons />
    </div>
  );
}
