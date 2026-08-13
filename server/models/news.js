const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const NewsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "El título de la noticia es obligatorio"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "El contenido de la noticia es obligatorio"],
      trim: true,
    },
    miniature: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: "Novedades",
      trim: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

NewsSchema.index({ active: 1, createdAt: -1 });
NewsSchema.index({ isFeatured: 1 });

NewsSchema.plugin(mongoosePaginate);

module.exports = mongoose.models.News || mongoose.model("News", NewsSchema);