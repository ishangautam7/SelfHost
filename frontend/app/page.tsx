'use client';

import { useAuth } from './context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import styles from './page.module.css';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) router.replace('/dashboard');
      else router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <div className={styles.loader}>
      <div className={styles.spinnerWrap}>
        <div className={styles.spinner} />
        <p>Loading SelfHost...</p>
      </div>
    </div>
  );
}
