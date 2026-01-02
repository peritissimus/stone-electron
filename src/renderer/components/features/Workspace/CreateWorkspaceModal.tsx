import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/base/ui/dialog';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';
import { ContainerStack, ContainerFlex } from '@renderer/components/base/ui';
import { Label, Text } from '@renderer/components/base/ui/text';
import { workspaceAPI } from '@renderer/api';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; folderPath: string }) => Promise<void> | void;
}

export function CreateWorkspaceModal({
  isOpen,
  isSubmitting = false,
  onClose,
  onSubmit,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setFolderPath('');
      setError(null);
    }
  }, [isOpen]);

  const isValid = useMemo(
    () => name.trim().length > 0 && folderPath.trim().length > 0,
    [name, folderPath],
  );

  const handleBrowse = async () => {
    try {
      const response = await workspaceAPI.selectFolder();

      if (response.success && response.data?.folderPath && !response.data.canceled) {
        setFolderPath(response.data.folderPath);
        setError(null);
      } else if (response.error) {
        setError(response.error.message || 'Failed to select folder');
      }
    } catch (e) {
      setError('Failed to open folder picker');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    try {
      await onSubmit({ name: name.trim(), folderPath: folderPath.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workspace');
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ContainerStack gap="md" className="py-4">
            <ContainerStack gap="xs">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Personal Notes"
                disabled={isSubmitting}
                autoFocus
              />
            </ContainerStack>

            <ContainerStack gap="xs">
              <Label htmlFor="workspace-folder">Workspace Folder</Label>
              <ContainerFlex align="center" gap="sm" className="w-full">
                <Input
                  id="workspace-folder"
                  value={folderPath}
                  onChange={(event) => setFolderPath(event.target.value)}
                  placeholder="Select or paste a folder path"
                  disabled={isSubmitting}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowse}
                  disabled={isSubmitting}
                >
                  Browse…
                </Button>
              </ContainerFlex>
              <Text size="xs" variant="muted">
                The workspace will mirror notes from this folder. Existing markdown files are
                imported automatically.
              </Text>
            </ContainerStack>

            {error && (
              <Text size="xs" variant="destructive">
                {error}
              </Text>
            )}
          </ContainerStack>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
