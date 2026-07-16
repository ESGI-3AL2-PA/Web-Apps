// AppError / NotFoundError / errorHandler are shared — see @repo/server-kit. Re-exported
// here (single class identity across both backends) so local import paths stay stable.
export { AppError, NotFoundError, errorHandler } from "@repo/server-kit";
