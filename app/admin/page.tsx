import AdminApp from "@/components/admin/AdminApp";
import RequireAuth from "@/components/admin/RequireAuth";

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminApp />
    </RequireAuth>
  );
}
