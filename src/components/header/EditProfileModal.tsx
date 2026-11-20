import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./EditProfileModal.preview";
import type { ComponentProps } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StaffProfileDetails from "./StaffProfileDetails";

function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Staff profile</DialogTitle>
        <DialogDescription>Your staff details from the hospital server.</DialogDescription>
      </DialogHeader>
      <StaffProfileDetails />
    </DialogContent>
  </Dialog>;
}

export default function MergedComponent(props: ComponentProps<typeof EditProfileModal>) {
  return IS_DEMO ? <PreviewComponent {...props} /> : <EditProfileModal {...props} />;
}
