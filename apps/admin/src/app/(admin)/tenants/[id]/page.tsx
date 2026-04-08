import { redirect } from 'next/navigation';

export default function TenantDetailsRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/partners/${params.id}`);
}
