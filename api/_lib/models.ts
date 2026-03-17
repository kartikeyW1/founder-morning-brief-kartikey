import mongoose from 'mongoose';
const { Schema } = mongoose;

const PrioritySchema = new Schema({
  userId: { type: String, default: 'pushkar' },
  date: { type: String, required: true },
  text: { type: String, required: true },
  done: { type: Boolean, default: false },
  carriedOver: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const WatchoutSchema = new Schema({
  userId: { type: String, default: 'pushkar' },
  date: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const IntentionSchema = new Schema({
  userId: { type: String, default: 'pushkar' },
  date: { type: String, required: true },
  text: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
});

const GoogleTokenSchema = new Schema({
  userId: { type: String, default: 'pushkar' },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

export const Priority = mongoose.models.Priority || mongoose.model('Priority', PrioritySchema);
export const Watchout = mongoose.models.Watchout || mongoose.model('Watchout', WatchoutSchema);
export const Intention = mongoose.models.Intention || mongoose.model('Intention', IntentionSchema);
export const GoogleToken = mongoose.models.GoogleToken || mongoose.model('GoogleToken', GoogleTokenSchema);
