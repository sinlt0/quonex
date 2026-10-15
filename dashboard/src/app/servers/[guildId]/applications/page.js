import { prisma } from '../../../../lib/db';
import { getGuildChannels, getGuildRoles } from '../../../../lib/guildResources';
import ModuleShell from '../../../../components/dash/ModuleShell';
import CreateApplicationPanelForm from './CreateApplicationPanelForm';
import ApplicationPanelManageCard from './ApplicationPanelManageCard';
import ApplicationReviewActions from './ApplicationReviewActions';

export default async function ApplicationsPage({ params }) {
  const { guildId } = await params;

  const [panels, pendingApplications, { textChannels }, roles] = await Promise.all([
    prisma.applicationPanel.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    prisma.application.findMany({ where: { guildId, status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 50 }),
    getGuildChannels(guildId),
    getGuildRoles(guildId)
  ]);

  const panelNameFor = panelId => panels.find(panel => panel.id === panelId)?.name || panelId;

  return (
    <ModuleShell moduleId="applications">
      <div className="space-y-6">
        <CreateApplicationPanelForm guildId={guildId} roles={roles} textChannels={textChannels} />
        {panels.length === 0 ? (
          <p className="text-sm text-neutral-400">No application panels yet.</p>
        ) : (
          <div className="space-y-3">
            {panels.map(panel => (
              <ApplicationPanelManageCard key={panel.id} guildId={guildId} panel={panel} roles={roles} textChannels={textChannels} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="dash-label pt-4">Pending applications</h2>
        {pendingApplications.length === 0 ? (
          <p className="text-neutral-400">No pending applications.</p>
        ) : (
          <div className="dash-card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-neutral-400">
                <tr>
                  <th className="px-4 py-2">Panel</th>
                  <th className="px-4 py-2">Applicant</th>
                  <th className="px-4 py-2">Submitted</th>
                  <th className="px-4 py-2">Answers</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingApplications.map(application => {
                  const answers = Array.isArray(application.answers) ? application.answers : [];
                  return (
                    <tr key={application.id} className="border-t border-[#1c2030] align-top transition-colors duration-150 hover:bg-[#121623]">
                      <td className="px-4 py-2">{panelNameFor(application.panelId)}</td>
                      <td className="px-4 py-2">{application.applicantId}</td>
                      <td className="px-4 py-2">{new Date(application.createdAt).toLocaleString()}</td>
                      <td className="max-w-xs px-4 py-2">
                        {answers.length === 0 ? (
                          <span className="text-neutral-500">No questions</span>
                        ) : (
                          <ul className="space-y-1 text-xs text-neutral-300">
                            {answers.map((entry, index) => (
                              <li key={index}>
                                <span className="text-neutral-500">{entry.question}:</span> {entry.answer || '—'}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <ApplicationReviewActions guildId={guildId} applicationId={application.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
