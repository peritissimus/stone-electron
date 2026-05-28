import type {
  ICreateNoteUseCase,
  ITemplateRepository,
  ITemplateUseCases,
  IWorkspaceRepository,
} from '../../../domain';
import { ListTemplatesUseCase } from './ListTemplatesUseCase';
import { CreateNoteFromTemplateUseCase } from './CreateNoteFromTemplateUseCase';

export { ListTemplatesUseCase } from './ListTemplatesUseCase';
export { CreateNoteFromTemplateUseCase } from './CreateNoteFromTemplateUseCase';

export interface TemplateUseCasesDeps {
  templateRepository: ITemplateRepository;
  workspaceRepository: IWorkspaceRepository;
  createNote: ICreateNoteUseCase;
}

export function createTemplateUseCases(deps: TemplateUseCasesDeps): ITemplateUseCases {
  return {
    listTemplates: new ListTemplatesUseCase(deps.templateRepository, deps.workspaceRepository),
    createNoteFromTemplate: new CreateNoteFromTemplateUseCase(
      deps.templateRepository,
      deps.workspaceRepository,
      deps.createNote,
    ),
  };
}
