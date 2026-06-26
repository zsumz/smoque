export function parseCsv(value: string): Array<Record<string, string>> {
    const rows = parseCsvRows(value);
    if (rows.length === 0) {
        return [];
    }

    const headers = rows[0] ?? [];
    const records = rows.slice(1);
    return records.map((record) => {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            row[header] = record[index] ?? '';
        });
        return row;
    });
}

function parseCsvRows(value: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index] ?? '';
        const next = value[index + 1];

        if (quoted) {
            if (char === '"' && next === '"') {
                field += '"';
                index += 1;
            } else if (char === '"') {
                quoted = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            quoted = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (char !== '\r') {
            field += char;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((entry) => entry.length > 1 || entry[0] !== '');
}
