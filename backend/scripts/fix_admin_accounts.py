import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

MONGO_URI = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'rezvo')
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    amb = await db.users.find_one({'email': 'peter.griffin8222@gmail.com'})
    if amb:
        await db.users.update_one(
            {'_id': amb['_id']},
            {'$set': {
                'password_hash': pwd_context.hash('Rezvo2024!'),
                'role': 'platform_admin',
                'updated_at': datetime.utcnow(),
            }},
        )
        biz_ids = amb.get('business_ids', [])
        print(f'[1] peter.griffin8222: password reset, role=platform_admin')
    else:
        biz_ids = []
        print('[1] peter.griffin8222 NOT FOUND')

    ibby = await db.users.find_one({'email': 'ibbyonline@gmail.com'})
    if ibby:
        await db.users.update_one(
            {'_id': ibby['_id']},
            {'$set': {
                'password_hash': pwd_context.hash('Reeve@Micho2026'),
                'role': 'business_owner',
                'business_ids': biz_ids if biz_ids else ibby.get('business_ids', []),
                'name': 'Micho Test',
                'updated_at': datetime.utcnow(),
            }},
        )
        print('[2] ibbyonline: updated')
    else:
        r = await db.users.insert_one({
            'email': 'ibbyonline@gmail.com',
            'name': 'Micho Test',
            'phone': '',
            'role': 'business_owner',
            'password_hash': pwd_context.hash('Reeve@Micho2026'),
            'avatar': None,
            'saved_businesses': [],
            'booking_history': [],
            'review_history': [],
            'business_ids': biz_ids,
            'stripe_connected': False,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        })
        print(f'[2] ibbyonline: CREATED id={r.inserted_id}')

    grant = await db.users.find_one({'email': 'grantwoods@live.com'})
    if grant:
        await db.users.update_one(
            {'_id': grant['_id']},
            {'$set': {'name': 'Grant Woods', 'updated_at': datetime.utcnow()}},
        )
        print('[3] Grant Woods: name fixed')
    else:
        print('[3] grantwoods@live.com NOT FOUND')

    client.close()
    print('Done!')

if __name__ == '__main__':
    asyncio.run(main())
