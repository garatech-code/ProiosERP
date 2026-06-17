export const formatUserName = (user) => {
    if (!user) return 'Usuario';
    const first = user.first_name?.trim() || '';
    const last = user.last_name?.trim() || '';
    if (first || last) {
        return `${first} ${last}`.trim();
    }
    return user.username || 'Usuario';
};

export const getUserInitials = (user) => {
    if (!user) return 'U';
    if (user.first_name && user.first_name.length > 0) {
        return user.first_name[0].toUpperCase();
    }
    if (user.username && user.username.length > 0) {
        return user.username[0].toUpperCase();
    }
    return 'U';
};
