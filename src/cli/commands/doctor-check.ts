export interface DoctorCheck {
    status: 'ok' | 'warn' | 'fail';
    name: string;
    message: string;
}

export function doctorStatusLabel(status: DoctorCheck['status']): string {
    if (status === 'ok') {
        return 'OK  ';
    }
    if (status === 'warn') {
        return 'WARN';
    }
    return 'FAIL';
}
