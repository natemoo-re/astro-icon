export class AstroIconError extends Error {
    public hint: string = '';
  
    constructor(message: string) {
      super(message);
    }
  }