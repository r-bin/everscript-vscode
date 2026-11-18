// What validation found: severity, rule id, file and JSON pointer (docs/open-evermore/validation.md §1, §4).
export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
    severity: Severity;
    rule: string;
    file: string;
    /** JSON pointer inside `file` ('/regions/3/sha1'), '' for the whole file. */
    pointer: string;
    message: string;
}

export class Findings {
    readonly list: Finding[] = [];
    add(severity: Severity, rule: string, file: string, pointer: string, message: string): void {
        this.list.push({ severity, rule, file, pointer, message });
    }
    error(rule: string, file: string, pointer: string, message: string): void { this.add('error', rule, file, pointer, message); }
    warning(rule: string, file: string, pointer: string, message: string): void { this.add('warning', rule, file, pointer, message); }
    info(rule: string, file: string, pointer: string, message: string): void { this.add('info', rule, file, pointer, message); }
    count(severity: Severity): number { return this.list.filter(f => f.severity === severity).length; }
    get failed(): boolean { return this.count('error') > 0; }
}
