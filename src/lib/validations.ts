import { z } from "zod";

// Helper para validar imagens
const imageFileSchema = z
  .file()
  .max(5_000_000, "Imagem deve ter no máximo 5MB")
  .mime(["image/jpeg", "image/png", "image/jpg", "image/webp"], "Formato de imagem inválido");

// Auth
export const signUpSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  photo: imageFileSchema.optional(),
});

export const signInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  photo: imageFileSchema.optional(),
});

// Categories
export const createCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  emoji: z.string().min(1, "Emoji é obrigatório"),
  type: z.enum(["income", "expense"]),
});

// Bank Accounts
export const createBankAccountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["checking", "savings"]),
  balance: z.number().default(0),
});

// Cards
export const createCardSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["debit", "credit"]),
  balance: z.number().default(0),
  limit: z.number().optional(),
});

// Transactions
export const createTransactionSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  type: z.enum(["income", "expense"]),
  date: z.string().datetime(),
  category: z.string().min(1, "Categoria é obrigatória"),
  categoryEmoji: z.string().optional(),
  paymentMethod: z.enum(["pix", "cash", "card", "bank"]).optional(),
  paymentMethodId: z.string().uuid().optional(),
  paymentMethodName: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  isPaid: z.boolean().default(true),
  installments: z.object({
    total: z.number().int().positive(),
    current: z.number().int().positive(),
  }).optional(),
  groupId: z.string().uuid().optional(),
  userName: z.string().optional(),
  userId: z.string().uuid().optional(),
});

export const updateTransactionSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.union([
    z.number().positive("Valor deve ser positivo"),
    z.string().transform((val) => parseFloat(val))
  ]),
  type: z.enum(["income", "expense"]),
  date: z.string().datetime(),
  category: z.string().min(1, "Categoria é obrigatória"),
  categoryEmoji: z.string().optional().nullable(),
  paymentMethod: z.enum(["pix", "cash", "card", "bank"]).optional().nullable(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  paymentMethodName: z.string().optional().nullable(),
  scheduledDate: z.string().datetime().optional().nullable(),
  isPaid: z.boolean().optional(),
  installments: z.object({
    total: z.number().int().positive(),
    current: z.number().int().positive(),
  }).optional().nullable(),
});

// Groups
export const createGroupSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  photo: imageFileSchema.optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  photo: imageFileSchema.optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

// Helper para validar FormData
export const parseFormData = <T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData
): z.infer<T> => {
  const data: Record<string, any> = {};
  
  formData.forEach((value, key) => {
    // Se for File, manter como File
    if (value instanceof File) {
      data[key] = value;
    } 
    // Se for string vazia, transformar em undefined
    else if (value === "") {
      data[key] = undefined;
    }
    // Tentar parsear JSON para objetos
    else if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
      try {
        data[key] = JSON.parse(value);
      } catch {
        data[key] = value;
      }
    }
    // Tentar converter números
    else if (typeof value === "string" && !isNaN(Number(value))) {
      data[key] = Number(value);
    }
    // Converter booleanos
    else if (value === "true" || value === "false") {
      data[key] = value === "true";
    }
    // Manter valor original
    else {
      data[key] = value;
    }
  });

  return schema.parse(data);
};
