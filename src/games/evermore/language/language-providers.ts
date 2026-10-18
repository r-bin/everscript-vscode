// Owner: code_highlighter/language-providers.js
// Thin re-export facade.
// All implementations live in per-concern modules in code_highlighter/.
// This file exists for backwards compatibility: extension.js and tests import from here.

import * as wsIndex from './workspace-index';
import * as hoverProv from './hover-provider';
import * as completeProv from './completion-provider';
import * as symbolProv from './symbol-provider';
import * as deadBranch from './dead-branch';
import * as defProv from './definition-provider';

export const loadIndex = wsIndex.loadIndex;
export const indexDocument = wsIndex.indexDocument;
export const buildWorkspaceIndex = wsIndex.buildWorkspaceIndex;
export const provideHover = hoverProv.provideHover;
export const provideCompletionItems = completeProv.provideCompletionItems;
export const getFunctionCompletions = completeProv.getFunctionCompletions;
export const getWorkspaceFunctionCompletions = completeProv.getWorkspaceFunctionCompletions;
export const getEnumNameCompletions = completeProv.getEnumNameCompletions;
export const provideDocumentSymbols = symbolProv.provideDocumentSymbols;
export const getDeadDecorationType = deadBranch.getDeadDecorationType;
export const updateDeadBranchDecorations = deadBranch.updateDeadBranchDecorations;
export const provideDefinition = defProv.provideDefinition;
export const provideReferences = defProv.provideReferences;
