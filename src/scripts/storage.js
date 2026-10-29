// localStorage bywa niedostępny (tryb prywatny, zablokowane ciasteczka) - błędy są celowo ignorowane.
export function readStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

export function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {}
}
