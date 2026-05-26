"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInWithGoogle } from "@/lib/actions/auth.action";

const handleSignIn = async () => {
  await signInWithGoogle();
};
const page = () => {
  return (
    <section className="h-screen w-full flex items-center justify-center">
      <Card className="w-100">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your credentials to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={handleSignIn}>
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </section>
  );
};

export default page;
