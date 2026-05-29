'use client';

import { Plus, Loader2, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PlayerForm {
  name: string;
  gamertag: string;
  tier: string;
  division: string;
  city: string;
  phone: string;
  joki: string;
  points: string;
  clubId: string;
}

export const emptyForm: PlayerForm = {
  name: '',
  gamertag: '',
  tier: 'B',
  division: 'male',
  city: '',
  phone: '',
  joki: '',
  points: '0',
  clubId: '_none',
};

interface PlayerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPlayer: { id: string; data: PlayerForm } | null;
  formData: PlayerForm;
  setFormData: (data: PlayerForm | ((prev: PlayerForm) => PlayerForm)) => void;
  clubs: any[];
  storeDivision: string;
  isPending: boolean;
  onSubmit: () => void;
}

export function PlayerFormDialog({
  open,
  onOpenChange,
  editingPlayer,
  formData,
  setFormData,
  clubs,
  storeDivision,
  isPending,
  onSubmit,
}: PlayerFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPlayer ? 'Edit Player' : 'Tambah Player Baru'}</DialogTitle>
          <DialogDescription>{editingPlayer ? 'Perbarui informasi player yang sudah terdaftar' : 'Isi form untuk menambahkan player baru ke sistem'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Division */}
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Division</Label>
              <div className="flex items-center bg-muted rounded-lg p-1 mt-1 gap-1">
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, division: 'male', clubId: '' }))}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors duration-150 ${
                    formData.division === 'male'
                      ? 'bg-idm-male text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🕺 Cowo
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, division: 'female', clubId: '' }))}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors duration-150 ${
                    formData.division === 'female'
                      ? 'bg-idm-female text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  💃 Cewe
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">Nama <span className="text-red-400">*</span></Label>
              <Input
                placeholder="Nama lengkap/nickname"
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="mt-1"
              />
            </div>

            {/* Nickname */}
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">Nickname <span className="text-red-400">*</span></Label>
              <Input
                placeholder="Username unik"
                value={formData.gamertag}
                onChange={(e) => setFormData(p => ({ ...p, gamertag: e.target.value }))}
                className="mt-1"
              />
            </div>

            {/* Tier */}
            <div>
              <Label className="text-xs text-muted-foreground">Tier</Label>
              <Select value={formData.tier} onValueChange={(v) => setFormData(p => ({ ...p, tier: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S Tier</SelectItem>
                  <SelectItem value="A">A Tier</SelectItem>
                  <SelectItem value="B">B Tier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Points */}
            <div>
              <Label className="text-xs text-muted-foreground">Points</Label>
              <Input
                type="number"
                placeholder="0"
                value={formData.points}
                onChange={(e) => setFormData(p => ({ ...p, points: e.target.value }))}
                className="mt-1"
              />
            </div>

            {/* City */}
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">Kota</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Makassar, Jakarta, etc."
                  value={formData.city}
                  onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">No. WhatsApp</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="08xxxxxxxxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                  className="pl-9"
                  type="tel"
                />
              </div>
            </div>

            {/* Joki */}
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">Joki <span className="text-muted-foreground/70">(opsional)</span></Label>
              <Input
                placeholder="Nama joki jika ada"
                value={formData.joki}
                onChange={(e) => setFormData(p => ({ ...p, joki: e.target.value }))}
                className="mt-1"
              />
            </div>

            {/* Club */}
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">Club</Label>
              <Select value={formData.clubId} onValueChange={(v) => setFormData(p => ({ ...p, clubId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih club" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Tanpa Club</SelectItem>
                  {clubs?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button
            onClick={onSubmit}
            disabled={!formData.name.trim() || !formData.gamertag.trim() || isPending}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            {editingPlayer ? 'Simpan' : 'Tambah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
