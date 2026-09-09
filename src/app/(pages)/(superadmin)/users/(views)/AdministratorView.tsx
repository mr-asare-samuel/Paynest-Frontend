"use client"

import { useEffect, useMemo, useState } from 'react';
import {
    Search, Eye, Pencil, RefreshCcw, Users, MoreHorizontal,
    UserPlus, UserCog, Copy, Check, X,
} from 'lucide-react';
import { getOrganizationUsers } from '@/(api-handlers)/userHandler';
import { generateInvitationCode } from '@/(api-handlers)/organizationHandler';
import { UserResponse } from '@/interfaces/loginInterface';
import { GeneratedCodeResponse } from '@/interfaces/organization';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import Link from 'next/link';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const ROLE_BADGE: Record<string, string> = {
    superadmin: 'border-primary/30 bg-primary/10 text-primary',
    admin:      'border-info/30 bg-info/10 text-info',
    manager:    'border-success/30 bg-success/10 text-success',
    attendant:  'border-border bg-muted text-muted-foreground',
};

const ROLE_OPTIONS = ['admin', 'manager', 'attendant'];

function getInitials(first?: string, last?: string) {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

function fmtDate(iso?: string) {
    if (!iso) return null;
    const d = dayjs(iso);
    return d.isValid() ? d.format('MMM D, YYYY') : null;
}

export default function UsersAdministratorView() {
    const { user } = useAuthStore();
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [roleFilter, setRoleFilter] = useState('all');
    const [verifiedFilter, setVerifiedFilter] = useState('all');
    const [profileFilter, setProfileFilter] = useState('all');

    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [invitationCode, setInvitationCode] = useState<GeneratedCodeResponse | null>(null);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            setUsers(await getOrganizationUsers());
        } catch (error) {
            handleErrorMessage(error, 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);
    useEffect(() => { setCurrentPage(1); }, [searchText, roleFilter, verifiedFilter, profileFilter]);

    const filtered = useMemo(() => users.filter(u => {
        const matchesSearch = `${u.first_name} ${u.last_name} ${u.email} ${u.username}`
            .toLowerCase()
            .includes(searchText.toLowerCase());
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        const matchesVerified = verifiedFilter === 'all'
            || (verifiedFilter === 'verified' ? u.email_verified : !u.email_verified);
        const matchesProfile = profileFilter === 'all'
            || (profileFilter === 'linked' ? !!u.employee_profile : !u.employee_profile);
        return matchesSearch && matchesRole && matchesVerified && matchesProfile;
    }), [users, searchText, roleFilter, verifiedFilter, profileFilter]);

    const activeFilters = (roleFilter !== 'all' ? 1 : 0)
        + (verifiedFilter !== 'all' ? 1 : 0)
        + (profileFilter !== 'all' ? 1 : 0);

    const clearFilters = () => {
        setRoleFilter('all');
        setVerifiedFilter('all');
        setProfileFilter('all');
    };

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const currentUsers = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleGenerateCode = async () => {
        if (!user?.organization?.id) {
            toast.error('Organization ID not found');
            return;
        }
        setGeneratingCode(true);
        try {
            const response = await generateInvitationCode(user.organization.id);
            setInvitationCode(response);
            setIsInviteOpen(true);
        } catch (error) {
            handleErrorMessage(error, 'Failed to generate invitation code');
        } finally {
            setGeneratingCode(false);
        }
    };

    const copyToClipboard = () => {
        if (invitationCode?.code) {
            navigator.clipboard.writeText(invitationCode.code);
            setCopied(true);
            toast.success('Code copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const copyEmail = (email: string) => {
        navigator.clipboard.writeText(email);
        toast.success('Email copied');
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Users"
                description="Manage your organization users and their profiles."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9" onClick={fetchUsers} disabled={loading}>
                            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                        <Button onClick={handleGenerateCode} disabled={generatingCode}>
                            <UserPlus className="mr-2 size-4" />
                            {generatingCode ? 'Generating…' : 'Generate Invite Code'}
                        </Button>
                    </div>
                }
            />

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        placeholder="Search by name, email or username…"
                        className="h-9 pl-9"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        {ROLE_OPTIONS.map(r => (
                            <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
                    <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Verified" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any verification</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={profileFilter} onValueChange={setProfileFilter}>
                    <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Employee profile" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any profile</SelectItem>
                        <SelectItem value="linked">Profile linked</SelectItem>
                        <SelectItem value="none">No profile</SelectItem>
                    </SelectContent>
                </Select>

                {activeFilters > 0 && (
                    <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={clearFilters}>
                        <X className="size-3.5" /> Clear ({activeFilters})
                    </Button>
                )}
            </div>

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">User</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead>Verified</TableHead>
                                <TableHead>Employee Profile</TableHead>
                                <TableHead className="w-[70px] pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : currentUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Users className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No users found</p>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {searchText || activeFilters > 0
                                                ? 'Try adjusting your search or filters.'
                                                : 'No users in your organization yet.'}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : currentUsers.map(u => {
                                const joined = fmtDate(u.created_at);
                                const lastSeen = fmtDate(u.last_login);
                                return (
                                    <TableRow key={u.id}>
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-9 shrink-0 rounded-lg">
                                                    <AvatarImage src={u.profile_pic ?? undefined} alt={`${u.first_name} ${u.last_name}`} className="object-cover" />
                                                    <AvatarFallback className="rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                                                        {getInitials(u.first_name, u.last_name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-foreground">{u.first_name} {u.last_name}</p>
                                                    <p className="text-muted-foreground truncate text-xs">@{u.username}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn('capitalize text-xs rounded-full font-medium', ROLE_BADGE[u.role] ?? 'border-border bg-muted text-muted-foreground')}>
                                                {u.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-foreground text-sm">{joined ?? '—'}</p>
                                            {lastSeen && (
                                                <p className="text-muted-foreground text-[11px]">Last seen {lastSeen}</p>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-xs rounded-full",
                                                    u.email_verified
                                                        ? "border-success/30 bg-success/10 text-success"
                                                        : "border-warning/30 bg-warning/10 text-warning-foreground"
                                                )}
                                            >
                                                {u.email_verified ? 'Verified' : 'Pending'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-xs rounded-full",
                                                    u.employee_profile
                                                        ? "border-primary/20 bg-primary/10 text-primary"
                                                        : "border-border bg-muted text-muted-foreground"
                                                )}
                                            >
                                                {u.employee_profile ? 'Linked' : 'No Profile'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${u.first_name} ${u.last_name}`}>
                                                        <MoreHorizontal className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                                                        {u.first_name} {u.last_name}
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/users/${u.id}`}>
                                                            <Eye className="size-4" /> View profile
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {u.employee_profile ? (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/users/edit-employee-profile/${u.id}`}>
                                                                <Pencil className="size-4" /> Edit employee profile
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem asChild>
                                                            <Link href="/users/setup-employee-profile">
                                                                <UserCog className="size-4" /> Set up employee profile
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => copyEmail(u.email)}>
                                                        <Copy className="size-4" /> Copy email
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {!loading && filtered.length > 0 && (
                    <div className="border-border flex items-center justify-between gap-3 border-t px-6 py-3">
                        <p className="text-muted-foreground text-xs">
                            {filtered.length} user{filtered.length !== 1 ? 's' : ''}
                            {(searchText || activeFilters > 0) && users.length !== filtered.length && ` of ${users.length}`}
                        </p>
                        {filtered.length > ITEMS_PER_PAGE && (
                            <Pagination
                                page={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                                total={filtered.length}
                                isLoading={loading}
                            />
                        )}
                    </div>
                )}
            </Card>

            {/* Invitation Code Dialog */}
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Invitation Code Generated</DialogTitle>
                        <DialogDescription>
                            Share this code with the user you want to invite to your organization.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                        <div className="border-border bg-muted w-full rounded-lg border-2 border-dashed p-6 text-center">
                            <p className="font-mono text-4xl font-bold tracking-widest text-primary">
                                {invitationCode?.code}
                            </p>
                        </div>
                        {invitationCode?.expires_at && (
                            <p className="text-muted-foreground text-xs">
                                Expires: {new Date(invitationCode.expires_at).toLocaleString()}
                            </p>
                        )}
                        <Button className="w-full" onClick={copyToClipboard}>
                            {copied
                                ? <><Check className="mr-2 size-4" /> Copied!</>
                                : <><Copy className="mr-2 size-4" /> Copy Code</>
                            }
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
