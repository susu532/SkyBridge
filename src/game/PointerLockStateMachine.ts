export class PointerLockStateMachine {
  public lastUnlockTime: number = 0;
  
  constructor() {
    this.handleLockChange = this.handleLockChange.bind(this);
    document.addEventListener('pointerlockchange', this.handleLockChange);
  }

  private handleLockChange() {
    const locked = document.pointerLockElement === document.body;
    if (!locked) {
      this.lastUnlockTime = Date.now();
    }
  }

  public canLock(): boolean {
    const now = Date.now();
    const hasCooldown = now - this.lastUnlockTime < 1250;
    
    const hasActivation = ('userActivation' in navigator) 
      ? (navigator as any).userActivation.isActive 
      : true;

    return !hasCooldown && hasActivation;
  }

  public dispose() {
    document.removeEventListener('pointerlockchange', this.handleLockChange);
  }
}
