import { AuthButtons } from '~/components/header/AuthButtons';
import styles from '~/components/auth/AuthPage.module.scss';

export default function AuthPage() {
  return (
    <div className={styles.authPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Welcome Back</h1>
          <p>Sign in to continue to SprintSolo.dev</p>
        </div>
        <AuthButtons />
      </div>
    </div>
  );
}
