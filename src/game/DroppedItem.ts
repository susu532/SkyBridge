import { ItemType } from './Inventory';
import * as THREE from 'three';

export interface DroppedItem {
  id: string;
  type: ItemType;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  createdAt: number;
  pickupDelay: number; // Time in ms before it can be picked up
  velocity: THREE.Vector3;
  isGrounded: boolean;
  groundY: number;
}
