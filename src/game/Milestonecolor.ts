import * as THREE from 'three';

export function getMilestoneColor(kills: number): THREE.Color | null {
  if (kills >= 65) return new THREE.Color(0xffff00); // yellow
  if (kills >= 52) return new THREE.Color(0x8a2be2); // violet
  if (kills >= 39) return new THREE.Color(0x0000ff); // blue
  if (kills >= 26) return new THREE.Color(0x00ff00); // green
  if (kills >= 13) return new THREE.Color(0xff0000); // red
  return null;
}

export function applyMilestoneColor(kills: number, modelGroup: THREE.Group) {
  const color = getMilestoneColor(kills);
  modelGroup.traverse(child => {
    if (child instanceof THREE.Mesh) {
      if (!child.userData.originalColor) {
        child.userData.originalColor = child.material.color?.clone() || new THREE.Color(0xffffff);
      }
      if (color) {
         if (!child.userData.hasClonedMat) {
            child.material = child.material.clone();
            child.userData.hasClonedMat = true;
         }
         child.material.color.copy(color);
      } else {
         if (child.userData.hasClonedMat) {
            child.material.color.copy(child.userData.originalColor);
         }
      }
    }
  });
}
