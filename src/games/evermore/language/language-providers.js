'use strict';
// Owner: code_highlighter/language-providers.js
// Thin re-export facade.
// All implementations live in per-concern modules in code_highlighter/.
// This file exists for backwards compatibility: extension.js and tests import from here.

const wsIndex      = require('../../../../dist/games/evermore/language/workspace-index');
const hoverProv    = require('../../../../dist/games/evermore/language/hover-provider');
const completeProv = require('../../../../dist/games/evermore/language/completion-provider');
const symbolProv   = require('../../../../dist/games/evermore/language/symbol-provider');
const deadBranch   = require('../../../../dist/games/evermore/language/dead-branch');
const defProv      = require('../../../../dist/games/evermore/language/definition-provider');

module.exports = {
    // Data loading
    loadIndex:                    wsIndex.loadIndex,
    indexDocument:                wsIndex.indexDocument,
    buildWorkspaceIndex:          wsIndex.buildWorkspaceIndex,

    // Hover
    provideHover:                 hoverProv.provideHover,

    // Completions
    provideCompletionItems:       completeProv.provideCompletionItems,
    getFunctionCompletions:       completeProv.getFunctionCompletions,
    getWorkspaceFunctionCompletions: completeProv.getWorkspaceFunctionCompletions,
    getEnumNameCompletions:       completeProv.getEnumNameCompletions,

    // Symbols
    provideDocumentSymbols:       symbolProv.provideDocumentSymbols,

    // Dead branch
    getDeadDecorationType:        deadBranch.getDeadDecorationType,
    updateDeadBranchDecorations:  deadBranch.updateDeadBranchDecorations,

    // Definitions + references
    provideDefinition:            defProv.provideDefinition,
    provideReferences:            defProv.provideReferences,
};
