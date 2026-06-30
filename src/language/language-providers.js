'use strict';
// Owner: code_highlighter/language-providers.js
// Thin re-export facade.
// All implementations live in per-concern modules in code_highlighter/.
// This file exists for backwards compatibility: extension.js and tests import from here.

const wsIndex      = require('./workspace-index');
const hoverProv    = require('./hover-provider');
const completeProv = require('./completion-provider');
const symbolProv   = require('./symbol-provider');
const deadBranch   = require('./dead-branch');
const defProv      = require('./definition-provider');

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
