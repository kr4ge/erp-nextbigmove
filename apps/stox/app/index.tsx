import { Redirect } from 'expo-router';
import { useSession } from '@/src/features/auth/session-context';
import { canEnterStoxWorkspace } from '@/src/features/home/rbac';
import { LoadingScreen } from '@/src/shared/components/loading-screen';

export default function IndexScreen() {
  const { session, bootstrap, isHydrating } = useSession();

  if (isHydrating) {
    return <LoadingScreen label="Restoring STOX session" />;
  }

  if (!session || !bootstrap) {
    return <Redirect href="/login" />;
  }

  if (!canEnterStoxWorkspace(bootstrap)) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/home" />;
}
