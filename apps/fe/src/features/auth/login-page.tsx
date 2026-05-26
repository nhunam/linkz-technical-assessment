import { SignIn } from "@clerk/react";

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn routing="path" path="/login" signUpUrl="/signup" />
    </div>
  );
}
