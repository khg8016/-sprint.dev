import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition, RadioGroup } from '@headlessui/react';
import { useSupabaseManagement } from '~/lib/hooks/useSupabaseManagement';
import { useSupabaseAuth } from '~/lib/hooks/useSupabaseAuth';
import { supabase } from '~/lib/persistence/supabaseClient';

import type { Project, Organization } from '~/types/supabase';

interface SupabaseProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

export function SupabaseProjectModal({ isOpen, onClose, chatId }: SupabaseProjectModalProps) {
  const { userId } = useSupabaseAuth();
  const { loading, error, getProjects, createProject, getOrganizations } = useSupabaseManagement(userId);

  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dbPass: '',
    organizationId: '',
    region: 'us-east-1',
  });

  useEffect(() => {
    if (isOpen && userId) {
      loadProjects();
      loadOrganizations();
    }
  }, [isOpen, userId]);

  const loadOrganizations = async () => {
    try {
      const orgList = await getOrganizations();
      setOrganizations(orgList);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const projectsList = await getProjects();

      // Add default status for existing projects
      setProjects(
        projectsList.map((project) => ({
          ...project,
          status: 'ACTIVE',
        })),
      );
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const project = await createProject({
        name: formData.name,
        db_pass: formData.dbPass,
        organization_id: formData.organizationId,
        region: formData.region,
      });
      await connectProjectToChat({
        ...project,
        status: 'ACTIVE',
      });
      onClose();
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleSelectProject = async () => {
    if (!selectedProject) {
      return;
    }

    try {
      await connectProjectToChat(selectedProject);
      onClose();
    } catch (err) {
      console.error('Failed to connect project:', err);
    }
  };

  const connectProjectToChat = async (project: Project) => {
    try {
      // Deactivate any existing connections first
      await supabase
        .from('chat_supabase_connections')
        .update({ is_active: false })
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      // Create new connection
      const { error } = await supabase.from('chat_supabase_connections').insert([
        {
          user_id: userId,
          chat_id: chatId,
          project_id: project.id,
          project_organization_id: project.organization_id,
          project_name: project.name,
          project_region: project.region,
          project_created_at: project.created_at,
          project_status: project.status,
          is_active: true,
        },
      ]);

      if (error) {
        throw error;
      }

      // Dispatch a custom event to notify that a project was connected
      window.dispatchEvent(
        new CustomEvent('supabaseProjectConnected', {
          detail: {
            projectId: project.id,
            chatId,
          },
        }),
      );
    } catch (error) {
      throw error;
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                  {isCreatingNew ? 'Create New Project' : 'Select Project'}
                </Dialog.Title>

                {error && (
                  <div className="mt-2 p-4 bg-red-100 dark:bg-red-900 rounded-md text-red-700 dark:text-red-100">
                    {error.message}
                  </div>
                )}

                {isCreatingNew ? (
                  <form onSubmit={handleCreateProject} className="mt-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Project Name
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Database Password
                        </label>
                        <input
                          type="password"
                          value={formData.dbPass}
                          onChange={(e) => setFormData({ ...formData, dbPass: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Organization
                        </label>
                        <select
                          value={formData.organizationId}
                          onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                          required
                        >
                          <option value="">Select an organization</option>
                          {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Region</label>
                        <select
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        >
                          {/* AWS Regions */}
                          <optgroup label="AWS Regions">
                            <option value="us-east-1">US East (N. Virginia)</option>
                            <option value="us-west-1">US West (N. California)</option>
                            <option value="us-west-2">US West (Oregon)</option>
                            <option value="ca-central-1">Canada (Central)</option>
                            <option value="sa-east-1">South America (São Paulo)</option>
                            <option value="eu-west-1">EU (Ireland)</option>
                            <option value="eu-west-2">EU (London)</option>
                            <option value="eu-west-3">EU (Paris)</option>
                            <option value="eu-central-1">EU (Frankfurt)</option>
                            <option value="eu-north-1">EU (Stockholm)</option>
                            <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                            <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                            <option value="ap-northeast-2">Asia Pacific (Seoul)</option>
                            <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                            <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                          </optgroup>
                          {/* Google Cloud Regions */}
                          <optgroup label="Google Cloud Regions">
                            <option value="asia-east1">Asia East (Taiwan)</option>
                            <option value="asia-southeast1">Asia Southeast (Singapore)</option>
                            <option value="australia-southeast1">Australia Southeast (Sydney)</option>
                            <option value="europe-west1">Europe West (Belgium)</option>
                            <option value="europe-west2">Europe West (London)</option>
                            <option value="northamerica-northeast1">North America Northeast (Montreal)</option>
                            <option value="us-central1">US Central (Iowa)</option>
                            <option value="us-east1">US East (South Carolina)</option>
                            <option value="us-west1">US West (Oregon)</option>
                          </optgroup>
                          {/* Azure Regions */}
                          <optgroup label="Azure Regions">
                            <option value="eastus">East US (Virginia)</option>
                            <option value="eastus2">East US 2 (Virginia)</option>
                            <option value="centralus">Central US (Iowa)</option>
                            <option value="westus">West US (California)</option>
                            <option value="westus2">West US 2 (Washington)</option>
                            <option value="northeurope">North Europe (Ireland)</option>
                            <option value="westeurope">West Europe (Netherlands)</option>
                            <option value="southeastasia">Southeast Asia (Singapore)</option>
                            <option value="eastasia">East Asia (Hong Kong)</option>
                            <option value="japaneast">Japan East (Tokyo)</option>
                            <option value="japanwest">Japan West (Osaka)</option>
                          </optgroup>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsCreatingNew(false)}
                        className="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      >
                        {loading ? 'Creating...' : 'Create Project'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4">
                    <button
                      onClick={() => setIsCreatingNew(true)}
                      className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                    >
                      Create New Project
                    </button>

                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Or select existing project:</h4>
                      {loading ? (
                        <div className="mt-2 text-center py-4 text-gray-500">Loading projects...</div>
                      ) : (
                        <RadioGroup value={selectedProject} onChange={setSelectedProject} className="mt-2">
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {projects.map((project) => (
                              <RadioGroup.Option
                                key={project.id}
                                value={project}
                                className={({ active, checked }) =>
                                  `${active ? 'ring-2 ring-blue-500 ring-opacity-60 ring-offset-2' : ''}
                                  ${checked ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700'}
                                  relative flex cursor-pointer rounded-lg px-5 py-4 shadow-md focus:outline-none`
                                }
                              >
                                {({ checked }) => (
                                  <div className="flex w-full items-center justify-between">
                                    <div className="flex items-center">
                                      <div className="text-sm">
                                        <RadioGroup.Label
                                          as="p"
                                          className={`font-medium ${
                                            checked ? 'text-white' : 'text-gray-900 dark:text-white'
                                          }`}
                                        >
                                          {project.name}
                                        </RadioGroup.Label>
                                        <RadioGroup.Description
                                          as="span"
                                          className={`inline ${checked ? 'text-blue-100' : 'text-gray-500'}`}
                                        >
                                          Region: {project.region} | Status: {project.status}
                                        </RadioGroup.Description>
                                      </div>
                                    </div>
                                    {checked && (
                                      <div className="shrink-0 text-white">
                                        <CheckIcon className="h-6 w-6" />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </RadioGroup.Option>
                            ))}
                          </div>
                        </RadioGroup>
                      )}

                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={handleSelectProject}
                          disabled={!selectedProject || loading}
                          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
                        >
                          Connect Selected Project
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx={12} cy={12} r={12} fill="#fff" opacity="0.2" />
      <path d="M7 13l3 3 7-7" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
