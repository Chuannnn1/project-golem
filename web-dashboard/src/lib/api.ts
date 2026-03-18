const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : "http://localhost:3001");


export function apiUrl(path: string): string {
    return `${API_BASE}${path}`;
}
