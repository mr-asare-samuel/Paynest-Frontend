"use client"

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/(zustand-store)/authStore';
import { getOrganizationUsers } from '@/(api-handlers)/userHandler';
import { UserResponse } from '@/interfaces/loginInterface';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import PageHeader from '@/components/(shared-components)/PageHeader';
import Pagination from '@/components/(shared-components)/Pagination';
import { usePagination } from '@/hooks/usePagination';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, RefreshCcw, Wallet, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

function getInitials(first?: string, last?: string) {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function PayrollEmployeesPage() {
    const { user } = useAuthStore();
    const router = useRouter();

    const [users, setUsers] = useState<UserResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        if (user && user.role !== 'admin') router.replace('/dashboard');
    }, [user, router]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getOrganizationUsers();
            setUsers(data);
        } catch (err) {
            handleErrorMessage(err, 'Failed to load employees');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const withProfile = users.filter(u => !!u.employee_profile);
    const filtered = withProfile.filter(u =>
        `${u.first_name} ${u.last_name} ${u.email} ${u.employee_profile?.job_title ?? ''} ${u.employee_profile?.department ?? ''}`
            .toLowerCase()
            .includes(searchText.toLowerCase())
    );
    const withoutProfileCount = users.length - withProfile.length;
    const pg = usePagination(filtered, 10);

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Employee Payroll"
                description="Manage each employee's salary history and assigned benefits."
                actions={
                    <Button variant="outline" size="icon" className="size-9" onClick={fetchUsers} disabled={loading} aria-label="Refresh employees">
                        <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
                    </Button>
                }
            />

            <div className="relative max-w-sm">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                    placeholder="Search by name, email, job title…"
                    className="h-9 pl-9"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                />
            </div>

            {!loading && withoutProfileCount > 0 && (
                <div className="border-warning/30 bg-warning/5 text-warning-foreground rounded-lg border px-4 py-3 text-sm">
                    {withoutProfileCount} user{withoutProfileCount !== 1 ? 's' : ''} without an employee profile {withoutProfileCount !== 1 ? 'are' : 'is'} hidden here.{' '}
                    <Link href="/users/setup-employee-profile" className="font-medium underline">Set up an employee profile</Link> first to add them to payroll.
                </div>
            )}

            <Card className="gap-0 overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Employee</TableHead>
                                <TableHead>Job Title</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Employee Code</TableHead>
                                <TableHead className="pr-6 w-[160px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 5 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-20 text-center">
                                        <div className="bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                            <Wallet className="text-muted-foreground size-7" />
                                        </div>
                                        <p className="text-foreground font-semibold">No employees found</p>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {searchText ? 'Try a different search term.' : 'No employees with a profile yet.'}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : pg.pageItems.map(u => (
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
                                                <p className="text-foreground truncate text-sm font-semibold leading-tight">{u.first_name} {u.last_name}</p>
                                                <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{u.employee_profile?.job_title || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{u.employee_profile?.department || '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="rounded-full font-mono text-xs">{u.employee_profile?.employee_code || '—'}</Badge>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-3 text-xs" asChild>
                                            <Link href={`/payroll/employees/${u.employee_profile!.id}?user_id=${u.id}`}>
                                                <UserCog className="size-3.5" /> Manage Payroll
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!loading && filtered.length > 0 && (
                    <div className="border-border bg-muted/30 border-t px-4 py-3">
                        <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
                    </div>
                )}
            </Card>
        </div>
    );
}
