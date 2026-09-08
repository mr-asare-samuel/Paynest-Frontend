"use client"

import { useState } from "react";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Wallet } from "lucide-react";
import AuthLeftPanel from "@/components/(shared-components)/AuthLeftPanel";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { loginSchema, LoginFormData } from "@/utils/zod/loginSchemas";
import { toast } from "sonner";
import { handleErrorMessage } from "@/utils/handleErrorMessage";
import { loginWithFormData } from "@/(api-handlers)/loginHandler";
import { getUserData } from "@/(api-handlers)/userHandler";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/(zustand-store)/authStore";
import { useEntitlementStore } from "@/(zustand-store)/entitlementStore";
import { setCookie } from "cookies-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function LoginPage() {
    const [isLoading, setIsLoading]       = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const { register, handleSubmit, formState: { errors }, watch } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema) as Resolver<LoginFormData>,
        defaultValues: { email_or_username: "", password: "", remember_me: false },
    });

    const emailOrUsernameValue = watch("email_or_username");

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        const fd = new FormData();
        fd.append("username", data.email_or_username);
        fd.append("password", data.password);
        try {
            const response = await loginWithFormData(fd);
            if (response) {
                setCookie("pos_token", response.access_token, { maxAge: 30 * 24 * 60 * 60, path: "/" });
                setCookie("user_role", response.user?.role || "attendant", { maxAge: 30 * 24 * 60 * 60, path: "/" });
                const { setAuth, updateUser } = useAuthStore.getState();
                setAuth(response);
                void useEntitlementStore.getState().fetchEntitlements();
                let currentUser = response.user;
                try {
                    currentUser = await getUserData();
                    updateUser(currentUser);
                } catch (e) { handleErrorMessage(e, "Failed to fetch user data."); }
                toast.success("Login successful!");
                const role = currentUser?.role;
                if ((role === "manager" || role === "attendant") && !currentUser?.employee_profile) {
                    router.push("/account-pending");
                } else if (role === "attendant") router.push("/sales");
                else if (role === "manager") router.push("/orders");
                else router.push("/dashboard");
            }
        } catch (error: any) {
            const detail = error?.response?.data?.detail;
            if (error?.response?.status === 403 && detail === "EMAIL_NOT_VERIFIED") {
                const username = data.email_or_username;
                const emailParam = username.includes("@") ? `?email=${encodeURIComponent(username)}` : "";
                router.push(`/verify-email/pending${emailParam}`);
                return;
            }
            if (error?.response?.status === 403 && detail === "ORGANIZATION_DEACTIVATED") {
                toast.error("Your organization's account has been suspended.", {
                    description: "Contact support for assistance.",
                    duration: 8000,
                });
                return;
            }
            if (error?.response?.status === 403 && detail === "SUBSCRIPTION_EXPIRED") {
                toast.error("Your organization's subscription has expired.", {
                    description: "Contact your administrator to reactivate access.",
                    duration: 8000,
                });
                return;
            }
            handleErrorMessage(error, "Login failed. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden">

            {/* ═══ LEFT PANEL ═══ */}
            <AuthLeftPanel
                title={<>Sell faster.<br />Grow bigger.</>}
                description="The complete POS platform built for modern retail and hospitality businesses."
            />

            {/* ═══ RIGHT PANEL ═══ */}
            <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-14 overflow-y-auto">

                {/* Mobile logo */}
                <div className="lg:hidden mb-10 flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
                        <Wallet className="size-[18px] text-primary-foreground" />
                    </div>
                    <span className="text-[22px] font-extrabold text-foreground">Paynest</span>
                </div>

                <div className="w-full max-w-[400px]">

                    <div className="mb-8 text-center">
                        <h2 className="text-[28px] font-extrabold tracking-tight text-foreground">Welcome back</h2>
                        <p className="mt-1.5 text-[14px] text-muted-foreground">Sign in to your account to continue</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                        <div className="space-y-1.5">
                            <Label htmlFor="email_or_username" className="text-sm font-medium">Email or Username</Label>
                            <Input
                                id="email_or_username"
                                type="text"
                                disabled={isLoading}
                                placeholder="Enter your email or username"
                                className={cn("h-12 rounded-full px-5", errors.email_or_username && "border-destructive focus-visible:ring-destructive")}
                                {...register("email_or_username")}
                            />
                            {errors.email_or_username ? (
                                <p className="text-xs text-destructive">{errors.email_or_username.message}</p>
                            ) : emailOrUsernameValue ? (
                                <p className="text-xs text-muted-foreground">
                                    Logging in with {isEmail(emailOrUsernameValue) ? "email" : "username"}
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                                <Link href="/forget-password" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    disabled={isLoading}
                                    placeholder="Enter your password"
                                    className={cn("h-12 rounded-full px-5 pr-11", errors.password && "border-destructive focus-visible:ring-destructive")}
                                    {...register("password")}
                                />
                                <button
                                    type="button" tabIndex={-1}
                                    onClick={() => setShowPassword(p => !p)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox id="remember_me" disabled={isLoading} {...register("remember_me")} />
                            <Label htmlFor="remember_me" className="text-sm font-normal cursor-pointer text-muted-foreground">
                                Remember me for 30 days
                            </Label>
                        </div>

                        <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-full font-semibold text-sm">
                            {isLoading
                                ? <><Loader2 className="mr-2 size-4 animate-spin" />Signing in…</>
                                : "Sign in"}
                        </Button>
                    </form>

                    <p className="mt-8 text-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="font-semibold text-foreground hover:text-primary transition-colors">
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
