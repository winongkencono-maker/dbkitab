require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const executeMigration = async () => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        console.log('Creating ENUM types...');
        // Users & Auth Enums
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE auth_provider_enum AS ENUM ('email', 'google');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE user_role_enum AS ENUM ('user', 'admin');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;

            DO $$ BEGIN
                CREATE TYPE auth_token_type_enum AS ENUM ('reset_password', 'verify_email');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;

            DO $$ BEGIN
                CREATE TYPE subscription_status_enum AS ENUM ('active', 'canceled', 'expired', 'past_due');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE app_theme_enum AS ENUM ('light', 'dark', 'system');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE gender_enum AS ENUM ('male', 'female');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;

            DO $$ BEGIN
                CREATE TYPE reading_status_enum AS ENUM ('want_to_read', 'reading', 'finished');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;

            DO $$ BEGIN
                CREATE TYPE content_report_status_enum AS ENUM ('pending', 'resolved', 'rejected');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        console.log('Creating users and auth tables...');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                full_name VARCHAR(255),
                avatar_url VARCHAR(1000),
                auth_provider auth_provider_enum DEFAULT 'email',
                provider_id VARCHAR(255),
                role user_role_enum DEFAULT 'user',
                is_email_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS auth_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255) NOT NULL,
                type auth_token_type_enum NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                is_used BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                refresh_token VARCHAR(500) UNIQUE NOT NULL,
                device_info VARCHAR(255),
                ip_address VARCHAR(45),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_profiles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                phone_number VARCHAR(50),
                bio TEXT,
                date_of_birth DATE,
                gender gender_enum,
                location VARCHAR(255),
                app_language VARCHAR(10) DEFAULT 'id',
                app_theme app_theme_enum DEFAULT 'system',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Creating subscription and payment tables...');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                plan_id VARCHAR(50) NOT NULL,
                status subscription_status_enum NOT NULL,
                payment_gateway_customer_id VARCHAR(255),
                payment_gateway_sub_id VARCHAR(255),
                current_period_start TIMESTAMP WITH TIME ZONE,
                current_period_end TIMESTAMP WITH TIME ZONE,
                cancel_at_period_end BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
                order_id VARCHAR(100) UNIQUE NOT NULL,
                gross_amount DECIMAL(15, 2) NOT NULL,
                payment_type VARCHAR(50),
                transaction_status VARCHAR(50),
                snap_token VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Creating E-Book Reader core tables...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_library (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
                reading_status reading_status_enum DEFAULT 'want_to_read',
                is_downloaded_locally BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, book_id)
            );

            CREATE TABLE IF NOT EXISTS reading_progress (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
                last_page_number INTEGER,
                last_location_identifier VARCHAR(255),
                progress_percentage DECIMAL(5, 2) DEFAULT 0.00,
                last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, book_id)
            );

            CREATE TABLE IF NOT EXISTS bookmarks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
                page_number INTEGER,
                location_identifier VARCHAR(255),
                bookmark_title VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS highlights (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
                highlighted_text TEXT NOT NULL,
                color_hex VARCHAR(10) DEFAULT '#FFFF00',
                start_position VARCHAR(255),
                end_position VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
                highlight_id UUID REFERENCES highlights(id) ON DELETE SET NULL,
                note_text TEXT NOT NULL,
                is_public BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Creating Engagement and Advanced Features tables...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS device_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                fcm_token VARCHAR(500) UNIQUE NOT NULL,
                device_model VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS search_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                search_query VARCHAR(500) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_collections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_collection_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                collection_id UUID REFERENCES user_collections(id) ON DELETE CASCADE,
                book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
                added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(collection_id, book_id)
            );

            CREATE TABLE IF NOT EXISTS book_reviews (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                review_text TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, book_id)
            );

            CREATE TABLE IF NOT EXISTS content_reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
                location_identifier VARCHAR(255),
                reported_text TEXT,
                suggested_correction TEXT,
                status content_report_status_enum DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reading_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                duration_seconds INTEGER DEFAULT 0,
                UNIQUE(user_id, date)
            );
        `);

        await client.query('COMMIT');
        console.log('✅ ALL TABLES SUCCESSFULLY CREATED!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ MIGRATION FAILED:', e);
    } finally {
        client.release();
        pool.end();
    }
};

executeMigration();
