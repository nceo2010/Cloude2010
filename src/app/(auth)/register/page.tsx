import type { Metadata } from "next";
import Link from "next/link";

import { GoogleButton } from "@/components/auth/google-button";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { PasswordRegisterForm } from "@/components/auth/password-register-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Sign up with Google, email and password, or a magic link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <GoogleButton />

        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs uppercase">or</span>
          <span className="bg-border h-px flex-1" />
        </div>

        <PasswordRegisterForm redirectTo={redirectTo} />

        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs uppercase">or</span>
          <span className="bg-border h-px flex-1" />
        </div>

        <MagicLinkForm />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link
            href={routes.login}
            className="text-foreground font-medium underline"
          >
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
