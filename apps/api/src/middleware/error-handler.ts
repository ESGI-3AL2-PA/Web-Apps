// AppError / NotFoundError / errorHandler are shared — see @repo/shared. Re-exported
// here (single class identity across both backends) so local import paths stay stable.
import { AppError } from "@repo/shared";

export { AppError, NotFoundError, errorHandler } from "@repo/shared";

// Raised when a message's media bytes were stored but the mediaUrl could not be
// attached to the row. The use-case compensates (deletes bytes + row) before
// throwing this so no orphan is left behind. App-specific — extends the shared base.
export class ImageAttachError extends AppError {
  constructor() {
    super(500, "Failed to attach image to message");
  }
}
