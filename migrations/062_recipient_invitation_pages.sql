CREATE INDEX recipient_invitation_pages ON providers.invitations(email,created_at DESC,id DESC) WHERE state='pending';
