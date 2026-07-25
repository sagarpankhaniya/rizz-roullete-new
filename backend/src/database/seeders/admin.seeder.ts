/**
 * Seeds the default admin account.
 *
 * Usage: npm run seed:admin
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'admin.rizzroulette@yopmail.com';
const ADMIN_PASSWORD = 'Admin@123';
const ADMIN_FIRST_NAME = 'Admin';
const SALT_ROUNDS = 12;

async function seedAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  const users = mongoose.connection.collection('users');

  const email = ADMIN_EMAIL.toLowerCase().trim();
  const existing = await users.findOne({ email });

  if (existing) {
    await users.updateOne(
      { email },
      {
        $set: {
          role: 'admin',
          firstName: ADMIN_FIRST_NAME,
          password: await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS),
          isBanned: false,
          banReason: null,
          bannedAt: null,
        },
      },
    );
    console.log(`Updated existing admin: ${email}`);
  } else {
    const now = new Date();
    await users.insertOne({
      firstName: ADMIN_FIRST_NAME,
      email,
      password: await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS),
      role: 'admin',
      gender: null,
      interestedIn: null,
      country: null,
      matchCountry: null,
      photo: null,
      isSubscribed: false,
      subscriptionPlan: null,
      subscribedAt: null,
      isVip: false,
      creatorInviteId: null,
      registrationIp: null,
      userAgent: null,
      isBanned: false,
      banReason: null,
      bannedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Created admin: ${email}`);
  }

  await mongoose.disconnect();
  console.log('Admin seed complete.');
}

seedAdmin().catch(async (err) => {
  console.error('Admin seed failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
