import type { BodyRegionDef } from "../types";

export const BODY_REGIONS: BodyRegionDef[] = [
  { id: "face_forehead", label: "Testa", view: "face", cx: 50, cy: 18, r: 10 },
  { id: "face_left_eye", label: "Olho esquerdo", view: "face", cx: 38, cy: 32, r: 6 },
  { id: "face_right_eye", label: "Olho direito", view: "face", cx: 62, cy: 32, r: 6 },
  { id: "face_nose", label: "Nariz", view: "face", cx: 50, cy: 42, r: 6 },
  { id: "face_cheeks", label: "Maçãs do rosto", view: "face", cx: 50, cy: 52, r: 10 },
  { id: "face_mouth", label: "Boca / Lábios", view: "face", cx: 50, cy: 62, r: 7 },
  { id: "face_chin", label: "Queixo", view: "face", cx: 50, cy: 74, r: 7 },
  { id: "face_jaw", label: "Mandíbula", view: "face", cx: 50, cy: 84, r: 8 },
  { id: "front_neck", label: "Pescoço", view: "front", cx: 50, cy: 12, r: 6 },
  { id: "front_chest", label: "Tórax", view: "front", cx: 50, cy: 24, r: 10 },
  { id: "front_abdomen", label: "Abdômen", view: "front", cx: 50, cy: 38, r: 10 },
  { id: "front_left_arm", label: "Braço esquerdo", view: "front", cx: 28, cy: 28, r: 7 },
  { id: "front_right_arm", label: "Braço direito", view: "front", cx: 72, cy: 28, r: 7 },
  { id: "front_left_forearm", label: "Antebraço esquerdo", view: "front", cx: 18, cy: 42, r: 6 },
  { id: "front_right_forearm", label: "Antebraço direito", view: "front", cx: 82, cy: 42, r: 6 },
  { id: "front_left_hand", label: "Mão esquerda", view: "front", cx: 12, cy: 54, r: 5 },
  { id: "front_right_hand", label: "Mão direita", view: "front", cx: 88, cy: 54, r: 5 },
  { id: "front_pelvis", label: "Pelve", view: "front", cx: 50, cy: 50, r: 8 },
  { id: "front_left_thigh", label: "Coxa esquerda", view: "front", cx: 42, cy: 64, r: 8 },
  { id: "front_right_thigh", label: "Coxa direita", view: "front", cx: 58, cy: 64, r: 8 },
  { id: "front_left_knee", label: "Joelho esquerdo", view: "front", cx: 42, cy: 76, r: 5 },
  { id: "front_right_knee", label: "Joelho direito", view: "front", cx: 58, cy: 76, r: 5 },
  { id: "front_left_leg", label: "Perna esquerda", view: "front", cx: 42, cy: 88, r: 6 },
  { id: "front_right_leg", label: "Perna direita", view: "front", cx: 58, cy: 88, r: 6 },
  { id: "back_nape", label: "Nuca", view: "back", cx: 50, cy: 10, r: 6 },
  { id: "back_shoulders", label: "Ombros", view: "back", cx: 50, cy: 18, r: 10 },
  { id: "back_upper", label: "Costas superiores", view: "back", cx: 50, cy: 28, r: 10 },
  { id: "back_lower", label: "Lombar", view: "back", cx: 50, cy: 42, r: 10 },
  { id: "back_glutes", label: "Glúteos", view: "back", cx: 50, cy: 54, r: 9 },
  { id: "back_left_arm", label: "Braço esquerdo (costas)", view: "back", cx: 28, cy: 28, r: 7 },
  { id: "back_right_arm", label: "Braço direito (costas)", view: "back", cx: 72, cy: 28, r: 7 },
  { id: "back_left_thigh", label: "Coxa esquerda (posterior)", view: "back", cx: 42, cy: 68, r: 8 },
  { id: "back_right_thigh", label: "Coxa direita (posterior)", view: "back", cx: 58, cy: 68, r: 8 },
  { id: "back_left_calf", label: "Panturrilha esquerda", view: "back", cx: 42, cy: 84, r: 6 },
  { id: "back_right_calf", label: "Panturrilha direita", view: "back", cx: 58, cy: 84, r: 6 },
];

export function findRegion(id: string): BodyRegionDef | undefined {
  return BODY_REGIONS.find((r) => r.id === id);
}
