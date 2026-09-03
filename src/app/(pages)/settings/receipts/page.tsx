"use client"

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/(zustand-store)/authStore';
import {
    GetReceiptConfig, UpdateReceiptConfig, UploadReceiptLogo,
} from '@/(api-handlers)/receiptsHandler';
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_SIZE_BYTES } from '@/(api-handlers)/userHandler';
import { handleErrorMessage } from '@/utils/handleErrorMessage';
import PageHeader from '@/components/(shared-components)/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Camera, ImageIcon, Info, Loader2, Receipt, Save, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ReceiptSettingsPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const role = (user?.role || '').toLowerCase();
    // Receipt config is organization-scoped. Superadmins have no organization,
    // so the backend rejects GET /receipts/config for them with a 400.
    const isAllowed = role === 'admin';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [headerNote, setHeaderNote] = useState('');
    const [footerText, setFooterText] = useState('');
    const [showTaxDetails, setShowTaxDetails] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user && !isAllowed) router.replace('/dashboard');
    }, [user, isAllowed, router]);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const config = await GetReceiptConfig();
            setLogoUrl(config.logo_url);
            setHeaderNote(config.header_note ?? '');
            setFooterText(config.footer_text ?? '');
            setShowTaxDetails(config.show_tax_details);
        } catch (error) {
            handleErrorMessage(error, 'Failed to load receipt settings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAllowed) fetchConfig();
    }, [isAllowed, fetchConfig]);

    const uploadLogo = async (file: File) => {
        const localUrl = URL.createObjectURL(file);
        setLogoPreview(localUrl);
        setUploadingLogo(true);
        try {
            const { logo_url } = await UploadReceiptLogo(file);
            setLogoUrl(logo_url);
            toast.success('Logo updated');
        } catch (error) {
            handleErrorMessage(error, "Couldn't upload logo");
        } finally {
            setUploadingLogo(false);
            setLogoPreview(null);
            URL.revokeObjectURL(localUrl);
        }
    };

    const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            toast.error('Only JPEG, PNG, and WebP images are supported');
            return;
        }
        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            toast.error('Image must be smaller than 5 MB');
            return;
        }

        uploadLogo(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await UpdateReceiptConfig({
                header_note: headerNote.trim() || null,
                footer_text: footerText.trim() || null,
                show_tax_details: showTaxDetails,
            });
            toast.success('Receipt settings saved');
        } catch (error) {
            handleErrorMessage(error, 'Failed to save receipt settings');
        } finally {
            setSaving(false);
        }
    };

    if (!user || !isAllowed) {
        return (
            <div className="flex items-center justify-center py-24">
                <Skeleton className="size-6 rounded-full" />
            </div>
        );
    }

    const logoSrc = logoPreview || logoUrl;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Receipt Settings"
                description="Customize the branding and layout used on printed and emailed receipts."
            />

            {loading ? (
                <Card className="p-6">
                    <Skeleton className="h-64 w-full" />
                </Card>
            ) : (
                <>
                    <Card className="gap-0 p-0">
                        <CardHeader className="border-border border-b px-6 py-4">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                                    <ImageIcon className="text-primary size-4" />
                                </div>
                                Logo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4 p-6">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleLogoFile}
                            />
                            <div className="group relative inline-block">
                                <div className="bg-muted border-border flex size-20 items-center justify-center overflow-hidden rounded-xl border">
                                    {logoSrc ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={logoSrc} alt="Receipt logo" className="size-full object-contain" />
                                    ) : (
                                        <ImageIcon className="text-muted-foreground size-8" />
                                    )}
                                </div>
                                <div className={cn(
                                    'absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100',
                                    uploadingLogo && 'opacity-100',
                                )}>
                                    {uploadingLogo ? (
                                        <Loader2 className="size-5 animate-spin text-white" />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            aria-label="Upload logo"
                                            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                                        >
                                            <Camera className="size-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="text-muted-foreground text-xs">
                                <p>Shown on the <span className="font-medium">full</span> (letter-size) receipt only — not on thermal receipts.</p>
                                <p className="mt-1">JPEG, PNG, or WebP · up to 5MB.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="gap-0 p-0">
                        <CardHeader className="border-border border-b px-6 py-4">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                                    <Receipt className="text-primary size-4" />
                                </div>
                                Layout
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 p-6">
                            <div className="space-y-1.5">
                                <Label>Header Note</Label>
                                <Textarea
                                    value={headerNote}
                                    onChange={(e) => setHeaderNote(e.target.value)}
                                    placeholder="e.g. 123 Main St, Accra"
                                    rows={2}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Footer Text</Label>
                                <Textarea
                                    value={footerText}
                                    onChange={(e) => setFooterText(e.target.value)}
                                    placeholder="e.g. Thank you for your business!"
                                    rows={2}
                                />
                            </div>

                            <div className="border-border flex items-center justify-between rounded-lg border p-4">
                                <div>
                                    <p className="text-foreground text-sm font-medium">Show tax breakdown</p>
                                    <p className="text-muted-foreground text-xs">Display subtotal, tax, and total lines on receipts.</p>
                                </div>
                                <Switch checked={showTaxDetails} onCheckedChange={setShowTaxDetails} />
                            </div>

                            <div className="text-muted-foreground flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-xs">
                                <Info className="text-info mt-0.5 size-4 shrink-0" />
                                <p>
                                    Receipts are cached per order after first render. Changes here only affect orders
                                    whose receipt hasn&apos;t been generated yet — already-downloaded receipts keep their
                                    original branding.
                                </p>
                            </div>

                            <div className="flex items-center justify-between border-t pt-5">
                                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                    <Sparkles className="size-3.5" /> Logo changes save instantly; other fields need Save.
                                </p>
                                <Button onClick={handleSave} disabled={saving} className="min-w-[140px] gap-1.5">
                                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
