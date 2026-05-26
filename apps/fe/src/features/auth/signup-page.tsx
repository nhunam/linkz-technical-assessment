import { SignUp } from "@clerk/react";

export function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp routing="path" path="/signup" signInUrl="/login" />
    </div>
  );
}
