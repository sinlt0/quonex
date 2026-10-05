import { getPublicCommands } from '../../lib/commands';
import CommandSearch from '../../components/CommandSearch';

export const metadata = { title: 'Commands' };

export default function CommandsPage() {
  const commands = getPublicCommands();

  return (
    <div className="fade-in-up mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Commands</h1>
      <p className="mt-2 text-neutral-400">
        Every command available to regular server members and staff. Prefix commands also work without a prefix for accounts
        granted no-prefix access.
      </p>
      <div className="mt-8">
        <CommandSearch commands={commands} />
      </div>
    </div>
  );
}
