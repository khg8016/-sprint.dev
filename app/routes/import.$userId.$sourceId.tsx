import React from 'react';
import { useLoaderData } from '@remix-run/react';
import DownloadSupabaseSource from '~/components/utils/DownloadSupabaseSource.client';
import { ClientOnly } from 'remix-utils/client-only';
import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';

export async function loader(args: LoaderFunctionArgs) {
  return json({ userId: args.params.userId, sourceId: args.params.sourceId });
}
export default function ImportPage() {
  const { userId, sourceId } = useLoaderData<{ userId?: string; sourceId?: string }>();

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <ClientOnly>
        {() => <DownloadSupabaseSource uploaderUserId={userId || ''} sourceId={sourceId || ''} />}
      </ClientOnly>
    </div>
  );
}
